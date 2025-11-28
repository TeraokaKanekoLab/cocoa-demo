#ifndef GRAPH_H_
#define GRAPH_H_
#define PREFETCH_HINT _MM_HINT_T0
#include "Eval.h"
#include "SFMT-src-1.5.1/SFMT.h"
#include <emmintrin.h>
#include <iostream>
#include <vector>
#include <unordered_map>
#include <map>
#include <unordered_set>
#include <set>
#include <queue>
#include <algorithm>
#include <string>
#include <fstream>
#include <sstream>
#include <ctime>
#include <cstdlib>
#include <cmath>
// #define NDEBUG
#include <cassert>
#include <filesystem>
using namespace std;

class Graph {
public:
    Graph(string data_dir, bool with_no_edge=false);

public:
    int node_size() const {
        return n;
    }
    int edge_size() const;
    int del_random_edge();
    // Node* get_node(int node_id);

    // node_id が dangling の場合，-1を返す
    virtual int get_random_adjacent(int node_id) const;
    void get_paths(int src_id, int walk_count, double alpha, vector<vector<int>>& paths) const;
    void get_paths_longer_than_1(int src_id, int walk_count, double alpha, vector<vector<int>>& paths) const;
    void get_paths_by_thunder_rw(int source_id, int walk_count, double alpha, vector<vector<int>>& paths, const vector<int>& degree_vec) const;
    vector<int> get_random_walk_end_nodes(int src_id, int walk_count, double alpha) const;
    map<int, double> calc_ppr_by_rw(int src_id,  int walk_count, double alpha) const;
    virtual pair<map<int, double>, map<int, double>> calc_ppr_by_fp(const map<int, double>& src_map, int walk_count, double alpha) const;
    map<int, double> calc_ppr_by_fora(int src_id, int walk_count, double alpha) const;
    map<int, double> calc_ppr_by_fora(const map<int, double>& src_map, int walk_count, double alpha) const;
    virtual pair<map<int, double>, map<int, double>> calc_ppr_by_fp_full_path(const map<int, double>& src_map, int walk_count, double alpha, double& total_step) const;
    map<int, double> calc_ppr_by_fora_full_path(const map<int, double>& src_map, int walk_count, double alpha) const;
    map<int, double> calc_ppr_by_fora_full_path(int src_id, int walk_count, double alpha) const;
    // map<int, double> calc_ppr_by_fora_plus_full_path(const map<int, double>& src_map, int walk_count, double alpha, Index& index) const;
    // map<int, double> calc_ppr_by_fora_plus_full_path(int src_id, int walk_count, double alpha, Index& index) const;
    virtual vector<double> calc_pagerank_by_power_iteration(double alpha, double epsilon) const;
    virtual vector<double> calc_eigenvector_centrality_by_power_iteration(double epsilon) const; 
    virtual vector<double> calc_degree_centrality() const; 
    virtual vector<double> get_distances_by_dijkstra(int source_id) const;
    vector<pair<int, double>> get_ordered_ppr(map<int, double> ppr) const;
    bool get_is_directed() const {
        return is_directed;
    }
    virtual void show_edge_list() const;
    // void insert_edge(Node* src_node, Node* dst_node); // undirected graph では両方向挿入
    
    // undirected graph では両方向挿入. 返り値は挿入したエッジ数
    int insert_edge(int src_id, int dst_id); 
    // undirected graph では両方向削除. 返り値は削除したエッジ数
    virtual int remove_edge(int src_id, int dst_id); 
    // virtual int remove_node(int node_id); 

    int get_adj_num(int node_id) const {
        return adj_list_list[node_id].size();
    }
    vector<int> get_adj_list(int node_id) const {
        return adj_list_list[node_id];
    };

    vector<pair<int, int>> load_edge_list() const;
    int get_initial_edge_count() const {
        return initial_edge_count;
    }
    bool get_is_dynamic() const {
        return is_dynamic;
    }
    bool get_is_weighted() const {
        return is_weighted;
    }
    string get_data_dir() const {
        return data_dir;
    }
    void show_graph_size_in_kb() const;
    bool has_edge(int src_id, int dst_id) const;
    void save_graph_to_file();
    void load_graph_from_binary();

protected:
    void _load_attribute();
    // vector<Node> nodes;
    vector<vector<int>> adj_list_list;
    vector<unordered_set<int>> adj_set_list;
    double r_max_func(int degree, double alpha, int walk_count, double r_max_coef) const {
        return degree * r_max_coef / (alpha * walk_count);
    }
    double r_max_func(int degree, double alpha, int walk_count) const {
        return r_max_func(degree, alpha, walk_count, 1);
    }
    bool is_directed;
    bool is_weighted;
    bool is_dynamic;
    bool is_bipartite;
    int n; // # of nodes
    int initial_edge_count = -1;
    string data_dir;
};

#endif